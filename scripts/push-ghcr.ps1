# Optional local publish. Daily path is: git push origin shu (GitHub Actions -> GHCR).
$ErrorActionPreference = "Stop"
$image = "ghcr.io/xiashus/shu-api"
$sha = (git rev-parse --short HEAD).Trim()
$version = "shu-$sha"
Set-Content -Path VERSION -Value $version -NoNewline
gh auth token | docker login ghcr.io -u XiaShus --password-stdin
docker buildx build --platform linux/amd64 -t "${image}:shu" -t "${image}:${version}" --push .
Write-Host "pushed ${image}:shu and ${image}:${version}"
