Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(scriptDir, "start-easy-agent-center.bat")
logDir = fso.BuildPath(scriptDir, "logs")
logPath = fso.BuildPath(logDir, "launcher.log")

If Not fso.FolderExists(logDir) Then
  fso.CreateFolder(logDir)
End If

command = "cmd.exe /d /c """ & batPath & """ --run >> """ & logPath & """ 2>>&1"
shell.Run command, 0, False
