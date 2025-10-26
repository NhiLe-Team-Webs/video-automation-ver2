@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Resolve repository root
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "START_INDEX="
if "%~1"=="" (
  set "START_INDEX=1"
) else (
  call :resolve_start "%~1"
  if defined START_INDEX (
    shift
  ) else (
    set "PREFIX=%~1"
    if /I "%PREFIX:~0,4%"=="STEP" (
      echo [ERROR] Unknown start step "%~1". Valid options: step1, step2.
      goto :EOF
    )
    for /f "delims=0123456789" %%A in ("%~1") do (
      if "%%A"=="" (
        echo [ERROR] Unknown start step "%~1". Valid options: step1, step2.
        goto :EOF
      )
    )
    set "START_INDEX=1"
  )
)

echo [INFO] Starting pipeline from step %START_INDEX%.

if %START_INDEX% LEQ 1 (
  REM Step 1: Run the Python enrichment pipeline (transcript -> plan.json)
  pushd "%ROOT%\python-be"
  call run_all.bat %*
  if errorlevel 1 (
    echo [ERROR] Python pipeline failed.
    popd
    goto :EOF
  )
  popd
)

if %START_INDEX% LEQ 2 (
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
  npm run build
  popd
)

endlocal
goto :EOF

:resolve_start
set "ARG=%~1"
if /I "%ARG%"=="STEP1" set "START_INDEX=1" & goto :EOF
if /I "%ARG%"=="1" set "START_INDEX=1" & goto :EOF
if /I "%ARG%"=="STEP2" set "START_INDEX=2" & goto :EOF
if /I "%ARG%"=="2" set "START_INDEX=2" & goto :EOF
goto :EOF
