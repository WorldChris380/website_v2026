@echo off
robocopy public dist\photography_2026\browser /E /XC /NJH /NJS /NP /NFL /NDL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0postbuild.ps1"