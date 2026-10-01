param(
    [ValidateSet('status','start','stop')][string]$Action = 'status',
    [string]$Uri = 'ws://127.0.0.1:4455'
)
$ErrorActionPreference = 'Stop'
$endpoint = [Uri]$Uri
if ($endpoint.Scheme -ne 'ws' -or $endpoint.Host -notin @('127.0.0.1','localhost','[::1]')) { throw 'Only local OBS endpoints are supported.' }
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$cancel = [System.Threading.CancellationTokenSource]::new(15000)
function Send-Obs($value) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 12 -Compress))
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $cancel.Token).GetAwaiter().GetResult()
}
function Receive-Obs {
    $stream = [IO.MemoryStream]::new()
    try {
        do {
            $buffer = [byte[]]::new(8192)
            $part = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $cancel.Token).GetAwaiter().GetResult()
            if ($part.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { throw 'OBS closed the connection.' }
            $stream.Write($buffer,0,$part.Count)
            if ($stream.Length -gt 1048576) { throw 'OBS response is too large.' }
        } until ($part.EndOfMessage)
        [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    } finally { $stream.Dispose() }
}
function Hash-Obs([string]$value) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { [Convert]::ToBase64String($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($value))) }
    finally { $hash.Dispose() }
}
function Request-Obs([string]$type) {
    $id = [Guid]::NewGuid().ToString()
    Send-Obs @{op=6;d=@{requestType=$type;requestId=$id}}
    do { $reply = Receive-Obs } until ($reply.op -eq 7 -and $reply.d.requestId -eq $id)
    if (-not $reply.d.requestStatus.result) { throw "OBS request failed: $type ($($reply.d.requestStatus.code))." }
    $reply.d.responseData
}
try {
    $socket.ConnectAsync($endpoint,$cancel.Token).GetAwaiter().GetResult()
    $hello = Receive-Obs
    if ($hello.op -ne 0) { throw 'Invalid OBS greeting.' }
    $identify = @{rpcVersion=1;eventSubscriptions=0}
    if ($hello.d.authentication) {
        $password = [Environment]::GetEnvironmentVariable('OBS_WEBSOCKET_PASSWORD')
        if (-not $password) { throw 'Set OBS_WEBSOCKET_PASSWORD locally before connecting.' }
        $secret = Hash-Obs ($password + $hello.d.authentication.salt)
        $identify.authentication = Hash-Obs ($secret + $hello.d.authentication.challenge)
        $password = $null; $secret = $null
    }
    Send-Obs @{op=1;d=$identify}
    $ready = Receive-Obs
    if ($ready.op -ne 2) { throw 'OBS identification failed.' }
    $state = Request-Obs 'GetRecordStatus'
    switch ($Action) {
        'status' { $state | ConvertTo-Json -Depth 8 }
        'start' {
            if ($state.outputActive) { throw 'OBS is already recording; refusing to take over.' }
            $null = Request-Obs 'StartRecord'
            $verified = Request-Obs 'GetRecordStatus'
            if (-not $verified.outputActive) { throw 'OBS did not enter recording state.' }
            $verified | ConvertTo-Json -Depth 8
        }
        'stop' {
            if (-not $state.outputActive) { throw 'OBS is not recording.' }
            Request-Obs 'StopRecord' | ConvertTo-Json -Depth 8
        }
    }
} finally {
    $socket.Dispose()
    $cancel.Dispose()
}
