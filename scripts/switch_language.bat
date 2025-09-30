@echo off
REM Language switcher script for Bonkfun Sniper README (Windows)
REM Usage: scripts\switch_language.bat [en|cn]

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

:show_usage
if "%1"=="-h" goto :help
if "%1"=="--help" goto :help
if "%1"=="help" goto :help
goto :main

:help
echo Usage: %0 [en^|cn]
echo.
echo Options:
echo   en    Switch to English README
echo   cn    Switch to Chinese README
echo   -h    Show this help message
echo.
echo Examples:
echo   %0 en    # Switch to English
echo   %0 cn    # Switch to Chinese
goto :eof

:main
if "%1"=="" goto :status
if "%1"=="en" goto :switch_english
if "%1"=="english" goto :switch_english
if "%1"=="English" goto :switch_english
if "%1"=="cn" goto :switch_chinese
if "%1"=="chinese" goto :switch_chinese
if "%1"=="Chinese" goto :switch_chinese
echo ❌ Invalid option: %1
echo.
goto :show_usage

:status
echo 🌐 Current language status:
if exist "%PROJECT_ROOT%\README_EN.md" (
    echo    📄 Currently showing: Chinese README
    echo    💡 Run '%0 en' to switch to English
) else (
    echo    📄 Currently showing: English README
    echo    💡 Run '%0 cn' to switch to Chinese
)
goto :eof

:switch_english
echo 🔄 Switching to English README...
if exist "%PROJECT_ROOT%\README.md" (
    move "%PROJECT_ROOT%\README.md" "%PROJECT_ROOT%\README_CN.md.backup" >nul
)
if exist "%PROJECT_ROOT%\README_EN.md" (
    copy "%PROJECT_ROOT%\README_EN.md" "%PROJECT_ROOT%\README.md" >nul
    echo ✅ Successfully switched to English README
) else (
    echo ❌ README_EN.md not found. Please ensure the English README exists.
    exit /b 1
)
goto :eof

:switch_chinese
echo 🔄 Switching to Chinese README...
if exist "%PROJECT_ROOT%\README.md" (
    move "%PROJECT_ROOT%\README.md" "%PROJECT_ROOT%\README_EN.md" >nul
)
if exist "%PROJECT_ROOT%\README_CN.md" (
    copy "%PROJECT_ROOT%\README_CN.md" "%PROJECT_ROOT%\README.md" >nul
    echo ✅ Successfully switched to Chinese README
) else (
    echo ❌ README_CN.md not found. Please ensure the Chinese README exists.
    exit /b 1
)
goto :eof
