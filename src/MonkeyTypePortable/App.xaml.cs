using System.Windows;

namespace MonkeyTypePortable;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += (_, args) =>
        {
            PortablePaths.Log("unhandled: " + args.Exception);
            MessageBox.Show(args.Exception.Message, "Monkeytype Portable", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };
        var smoke = e.Args.Contains("--smoke", StringComparer.OrdinalIgnoreCase);
        new MainWindow(smoke).Show();
    }
}
