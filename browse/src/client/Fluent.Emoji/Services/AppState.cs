// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Services;

public sealed class AppState(ILocalStorageService storage)
{
    private const string ThemePreferenceKey = "theme-preference";

    private ThemePreference _systemTheme = ThemePreference.System;
    private ThemePreference? _userThemePreference;

    public ThemePreference SystemTheme
    {
        get => _systemTheme;
        set
        {
            if (_systemTheme != value)
            {
                _systemTheme = value;
                AppStateChanged();
            }
        }
    }

    public ThemePreference UserThemePreference
    {
        get
        {
            if (_userThemePreference is null &&
                storage.GetItem<ThemePreference>(
                    ThemePreferenceKey) is ThemePreference preference)
            {
                _userThemePreference = preference;
            }

            return _userThemePreference ??= ThemePreference.System;
        }
        set
        {
            if (_userThemePreference != value)
            {
                _userThemePreference = value;
                storage.SetItem(ThemePreferenceKey, value);

                AppStateChanged();
            }
        }
    }

    public event Action? StateChanged;

    private void AppStateChanged() => StateChanged?.Invoke();
}
