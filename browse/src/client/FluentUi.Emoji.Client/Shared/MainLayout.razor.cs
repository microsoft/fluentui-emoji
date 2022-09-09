// Copyright (c) David Pine. All rights reserved.
// Licensed under the MIT License.

namespace FluentUi.Emoji.Client.Shared;

public sealed partial class MainLayout
{
    const string PrefersDarkThemeKey = "prefers-dark-scheme";

    private readonly MudTheme _theme = new()
    {
        Palette = new Palette()
        {
            Tertiary = "#7e6fff",
            DrawerIcon = "#aaa9b9",
            DrawerText = "#aaa9b9",
            DrawerBackground = "#303030"
        },
        PaletteDark = new Palette()
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

    bool _isDarkTheme;

    [Inject]
    private ILocalStorageService LocalStorage { get; set; } = null!;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            try
            {
                _isDarkTheme = LocalStorage.GetItem<bool>(PrefersDarkThemeKey);
            }
            catch (Exception ex) when (Debugger.IsAttached)
            {
                _ = ex;
                Debugger.Break();
            }

            await base.OnAfterRenderAsync(firstRender);
        }
    }

    private void OnToggledChanged(bool value) =>
        LocalStorage.SetItem(
            PrefersDarkThemeKey, _isDarkTheme = value);
}
