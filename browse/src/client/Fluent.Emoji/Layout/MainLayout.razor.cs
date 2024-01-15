// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Layout;

public sealed partial class MainLayout : IDisposable
{
    private readonly MudTheme _theme = new()
    {
        Palette = new PaletteLight()
        {
            Tertiary = "#7e6fff",
            DrawerIcon = "#aaa9b9",
            DrawerText = "#aaa9b9",
            DrawerBackground = "#303030"
        },
        PaletteDark = new PaletteDark()
        {
            Primary = "#7e6fff",
            Tertiary = "#7e6fff",
            Surface = "#1e1e2d",
            Background = "#1a1a27",
            BackgroundGrey = "#151521",
            AppbarText = "#92929f",
            AppbarBackground = "rgba(26,26,39,0.8)",
            DrawerBackground = "#1a1a27",
            ActionDefault = "#74718e",
            ActionDisabled = "#9999994d",
            ActionDisabledBackground = "#605f6d4d",
            TextPrimary = "#b2b0bf",
            TextSecondary = "#92929f",
            TextDisabled = "#ffffff33",
            DrawerIcon = "#92929f",
            DrawerText = "#92929f",
            GrayLight = "#2a2833",
            GrayLighter = "#1e1e2d",
            Info = "#4a86ff",
            Success = "#3dcb6c",
            Warning = "#ffb545",
            Error = "#ff3f5f",
            LinesDefault = "#33323e",
            TableLines = "#33323e",
            Divider = "#292838",
            OverlayLight = "#1e1e2d80"
        },
    };

    private bool IsDarkTheme { get; set; }

    private string ThemeIcon => State.UserThemePreference switch
    {
        ThemePreference.Dark => Icons.Material.TwoTone.DarkMode,
        ThemePreference.Light => Icons.Material.TwoTone.LightMode,
        _ => Icons.Material.TwoTone.AutoMode,
    };

    private string ThemeIconText => State.UserThemePreference switch
    {
        ThemePreference.Dark => "Switch to System Theme mode",
        ThemePreference.Light => "Switch to Dark Theme mode",
        _ => "Switch to Light Theme mode",
    };

    [Inject] public required AppService AppService { get; set; }
    [Inject] public required ILogger<MainLayout> Logger { get; set; }
    [Inject] public required AppState State { get; set; }

    protected override void OnInitialized()
    {
        State.StateChanged += StateHasChanged;

        var prefersDarkScheme =
            AppService.OnPrefersDarkSchemeChanged(PrefersDarkSchemeHandler);

        PrefersDarkSchemeHandler(prefersDarkScheme);

        base.OnInitialized();
    }

    private void EvaluateIsDarkMode() =>
        IsDarkTheme = State.UserThemePreference switch
        {
            ThemePreference.Dark => true,
            ThemePreference.Light => false,
            _ => State.SystemTheme is ThemePreference.Dark
        };

    private void PrefersDarkSchemeHandler(bool prefersDarkScheme)
    {
        Logger.LogInformation(
            "Prefers dark scheme: {Value}",
            prefersDarkScheme);

        State.SystemTheme = prefersDarkScheme
            ? ThemePreference.Dark
            : ThemePreference.Light;

        EvaluateIsDarkMode();
        StateHasChanged();
    }

    private void OnToggleDarkMode()
    {
        switch (State.UserThemePreference)
        {
            case ThemePreference.System:
                State.UserThemePreference = ThemePreference.Light;
                IsDarkTheme = false;
                break;

            case ThemePreference.Light:
                State.UserThemePreference = ThemePreference.Dark;
                IsDarkTheme = true;
                break;

            case ThemePreference.Dark:
                State.UserThemePreference = ThemePreference.System;
                IsDarkTheme = State.SystemTheme is ThemePreference.Dark;
                break;
        }
    }

    public void Dispose() => State.StateChanged += StateHasChanged;
}
