using System.IO;

namespace MonkeyTypePortable;

/// <summary>
/// Portable data lives in "MonkeyType-Data" next to the exe, so copying the exe together with
/// that folder moves all settings and results. Falls back to LocalAppData if the exe's folder
/// is read-only (e.g. a write-protected stick).
/// </summary>
public static class PortablePaths
{
    public static string ExeDir { get; } =
        Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory;

    public static string DataDir { get; } = ResolveDataDir();
    public static string WebViewDir => Path.Combine(DataDir, "WebView2");
    public static string WindowFile => Path.Combine(DataDir, "window.json");
    public static string LogFile => Path.Combine(DataDir, "monkeytype.log");

    static string ResolveDataDir()
    {
        var portable = Path.Combine(ExeDir, "MonkeyType-Data");
        if (CanWrite(portable)) return portable;
        var fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MonkeyTypePortable");
        Directory.CreateDirectory(fallback);
        return fallback;
    }

    static bool CanWrite(string dir)
    {
        try
        {
            Directory.CreateDirectory(dir);
            var probe = Path.Combine(dir, ".write-test");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static void Log(string message)
    {
        try
        {
            var info = new FileInfo(LogFile);
            if (info.Exists && info.Length > 512 * 1024) info.Delete();
            File.AppendAllText(LogFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
        }
        catch
        {
            // logging must never crash the app
        }
    }
}
