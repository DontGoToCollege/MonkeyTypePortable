using System.IO;
using System.Reflection;

namespace MonkeyTypePortable;

/// <summary>Serves the embedded web app (web/**) by URL path.</summary>
public static class WebAssets
{
    static readonly Assembly Asm = typeof(WebAssets).Assembly;

    // manifest names keep the build machine's separators; normalise to URL form once
    static readonly Dictionary<string, string> ByPath = Asm.GetManifestResourceNames()
        .Where(n => n.StartsWith("web/", StringComparison.Ordinal))
        .ToDictionary(n => n.Substring(4).Replace('\\', '/'), n => n, StringComparer.OrdinalIgnoreCase);

    static readonly Dictionary<string, string> Mime = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".json"] = "application/json; charset=utf-8",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".svg"] = "image/svg+xml",
        [".ico"] = "image/x-icon",
        [".woff2"] = "font/woff2",
        [".woff"] = "font/woff",
        [".txt"] = "text/plain; charset=utf-8",
    };

    public static int Count => ByPath.Count;

    public static Stream? Open(string urlPath, out string contentType)
    {
        var path = Uri.UnescapeDataString(urlPath).TrimStart('/');
        if (path.Length == 0) path = "index.html";
        contentType = Mime.TryGetValue(Path.GetExtension(path), out var m) ? m : "application/octet-stream";
        return ByPath.TryGetValue(path, out var name) ? Asm.GetManifestResourceStream(name) : null;
    }
}
