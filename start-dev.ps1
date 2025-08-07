$frontendPath = ".\saer-frontend"
$backendPath = ".\saer-backend"

Write-Host "Starting SAER Development Servers..." -ForegroundColor Green

# Start frontend in a new terminal window
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev"

# Start backend in a new terminal window
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; npm run dev"

Write-Host "Development servers have been started in new terminal windows." -ForegroundColor Green
Write-Host "Frontend server running in one terminal, backend server in another." -ForegroundColor Yellow
