﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Pages;

public sealed partial class Home
{
    private Dictionary<string, EmojiDetails>? _emoji;
    private string? _filter;

    private string _version = "";
    private IEnumerable<string> _versions = [];

    private IEnumerable<KeyValuePair<string, EmojiDetails>>? FilteredEmoji
    {
        get
        {
            if (_emoji is null)
            {
                return _emoji;
            }

            return _emoji.Where(kvp =>
            {
                var (name, emoji) = kvp;

                if (_versions?.Any(version => version == emoji.Metadata.FromVersion.Trim()) is false)
                {
                    return false;
                }

                return string.IsNullOrWhiteSpace(_filter)
                    || name.Contains(_filter, StringComparison.OrdinalIgnoreCase)
                    || emoji.Metadata.Keywords.Any(
                        k => k.Contains(_filter, StringComparison.OrdinalIgnoreCase));
            });
        }
    }

    private Dictionary<string, Dictionary<string, EmojiDetails>> GroupedEmoji
    {
        get
        {
            var groups =
                FilteredEmoji?.GroupBy(static kvp => kvp.Value.Metadata.Group);

            return groups?.ToDictionary(
                static g => g.Key,
                static g => g.OrderBy(static x => x.Key).ToDictionary())
                ?? [];
        }
    }

    [Inject] public required EmojiService EmojiService { get; set; }

    [Inject] public required AppState State { get; set; }

    [Inject] public required IDialogService DialogService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        _emoji = await EmojiService.GetAllEmojiAsync();

        _versions =
            State.EmojiVersions =
                _emoji?.Select(static e => e.Value.Metadata.FromVersion.Trim())
                    .DistinctBy(static version => version)
                    .OrderBy(static version => version, StringDigitComparer.Instance)
                    .ToHashSet() ?? [];
    }

    private async Task ShowEmojiDialog(string name, EmojiDetails details) =>
        await DialogService.ShowAsync<EmojiDialog>(
            $"{details.Metadata.Glyph} — {name}",
            new DialogParameters<EmojiDialog>
            {
                { x => x.MetadataUrl, $"emoji/{details.Metadata.Cldr.Replace(' ', '_')}/metadata.json" }
            },
            new()
            {
                ClassBackground = "blurred-bg"
            });
}
