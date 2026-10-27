using System.IO;
using System.Text.Json;

namespace MonkeyTypePortable;

/// <summary>Window placement and last theme background, stored in the portable data folder.</summary>
public sealed class WindowSettings
{
    public double Left { get; set; } = double.NaN;
    public double Top { get; set; } = double.NaN;
    public double Width { get; set; } = 1280;
    public double Height { get; set; } = 820;
    public bool Maximized { get; set; }
    public string Background { get; set; } = "#323437";
    public string Text { get; set; } = "#d1d0c5";

    static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static WindowSettings Load()
    {
        try
        {
            if (File.Exists(PortablePaths.WindowFile))
                return JsonSerializer.Deserialize<WindowSettings>(File.ReadAllText(PortablePaths.WindowFile)) ?? new();
        }
        catch (Exception ex)
        {
            PortablePaths.Log("window settings unreadable: " + ex.Message);
        }
        return new();
    }

    public void Save()
    {
        try
        {
            File.WriteAllText(PortablePaths.WindowFile, JsonSerializer.Serialize(this, Json));
        }
        catch (Exception ex)
        {
            PortablePaths.Log("window settings not saved: " + ex.Message);
        }
    }
}
