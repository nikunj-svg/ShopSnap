@echo off
echo ============================================================
echo           SHOPSNAP GITHUB UPLOADER UTILITY
echo ============================================================
echo.

:: Change directory to where the batch script is located
cd /d "%~dp0"

:: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed on this computer!
    echo.
    echo Please download and install Git from: https://git-scm.com/download/win
    echo After installing, close this window and double-click this file again.
    echo.
    pause
    exit /b
)

:: Initialize git repository if not already initialized
if not exist .git (
    echo [INFO] Initializing a new local Git repository...
    git init
    echo.
)

:: Add all files to Git
echo [INFO] Adding project files...
git add .

:: Commit files
echo [INFO] Creating save point...
git commit -m "Upload ShopSnap project"
git branch -M main
echo.

:: Prompt user to enter repository URL
echo To upload your code, you need to create a new repository on github.com.
echo Once created, copy the repository link.
echo.
set /p REPO_URL="Paste your GitHub repository URL here and press Enter: "

:: Clean remote URL if it already exists
git remote remove origin >nul 2>&1

:: Add remote URL
git remote add origin %REPO_URL%
echo.

:: Push code to github
echo [INFO] Uploading code to GitHub...
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ============================================================
    echo SUCCESS! Your code has been uploaded to GitHub.
    echo ============================================================
) else (
    echo.
    echo ============================================================
    echo FAILED! The upload did not complete.
    echo.
    echo Suggestions:
    echo 1. Verify you pasted the correct link.
    echo 2. Make sure you are logged into Git on this PC.
    echo 3. Make sure your internet connection is active.
    echo ============================================================
)
echo.
pause
