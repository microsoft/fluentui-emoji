// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.Collections.Concurrent;

namespace Fluent.Emoji.Services;

public sealed class AppService(IJSRuntime runtime)
{
    private readonly ConcurrentDictionary<Guid, Action<int, int>> s_callbackRegistry = new();

    private Action<bool>? _onPrefersDarkSchemeChanged;

    /// <summary>
    /// When the <c>window.matchMedia('(prefers-color-scheme: dark)').onchange</c> event fires,
    /// the given <paramref name="onPrefersDarkSchemeChanged"/> will have its callback invoked.
    /// </summary>
    /// <returns>
    /// Returns <c>true</c> when the preferred scheme is <c>dark</c>, else <c>false</c>.
    /// </returns>
    internal bool OnPrefersDarkSchemeChanged(Action<bool> onPrefersDarkSchemeChanged)
    {
        if (_onPrefersDarkSchemeChanged is not null)
        {
            throw new Exception("Only one callback can be registered at a time.");
        }

        _onPrefersDarkSchemeChanged = onPrefersDarkSchemeChanged;

        return runtime switch
        {
            IJSInProcessRuntime inProcessRuntime => inProcessRuntime.Invoke<bool>(
                "app.onPrefersDarkSchemeChanged",
                DotNetObjectReference.Create(this),
                nameof(OnPrefersDarkSchemeChanged)),

            _ => false
        };
    }

    [JSInvokable]
    public void OnPrefersDarkSchemeChanged(bool prefersDarkScheme) =>
        _onPrefersDarkSchemeChanged?.Invoke(prefersDarkScheme);
}
