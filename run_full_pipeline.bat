@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Resolve repository root
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

REM Step 1: Run the Python enrichment pipeline (transcript -> plan.json)
pushd "%ROOT%\python-be"
call run_all.bat %*
if errorlevel 1 (
  echo [ERROR] Python pipeline failed.
  popd
  goto :EOF
)
popd

REM Step 2: Start Remotion preview with regenerated inputs
pushd "%ROOT%\remotion-app"
if not exist node_modules (
  npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    popd
    goto :EOF
  )
)
npm start
popd

endlocal
