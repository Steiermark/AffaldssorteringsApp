param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Server running at http://localhost:$Port/"

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
}

function Send-Response {
  param(
    [System.Net.Sockets.TcpClient]$Client,
    [int]$Status,
    [string]$ContentType,
    [byte[]]$Body
  )

  $reason = if ($Status -eq 200) { "OK" } else { "Not Found" }
  $header = "HTTP/1.1 $Status $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream = $Client.GetStream()
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($Body, 0, $Body.Length)
  $stream.Flush()
  $Client.Close()
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $buffer = [byte[]]::new(4096)
    $read = $stream.Read($buffer, 0, $buffer.Length)
    $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $requestLine = ($request -split "`r`n")[0]
    $parts = $requestLine -split " "
    $requestPath = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
    $requestPath = [Uri]::UnescapeDataString($requestPath.Split("?")[0].TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $fullPath = Join-Path $root $requestPath
    $resolved = [System.IO.Path]::GetFullPath($fullPath)

    if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
      Send-Response -Client $client -Status 404 -ContentType "text/plain; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
      continue
    }

    $extension = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
    $contentType = $mimeTypes[$extension]
    if (-not $contentType) {
      $contentType = "application/octet-stream"
    }

    Send-Response -Client $client -Status 200 -ContentType $contentType -Body ([System.IO.File]::ReadAllBytes($resolved))
  }
}
finally {
  $listener.Stop()
}
