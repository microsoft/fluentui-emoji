// Copyright (c) David Pine. All rights reserved.
// Licensed under the MIT License.

namespace FluentUi.Emoji.Client.Pages;

public sealed partial class Index
{
    private Dictionary<string, EmojiDetails>? _emoji;
    private string? _search;

    private Dictionary<string, EmojiDetails>? FilteredEmoji
    {
        get
        {
            if (string.IsNullOrWhiteSpace(_search) || _emoji is null)
            {
                return _emoji;
            }

            return _emoji.Where(kvp =>
                    {
                        var (name, emoji) = kvp;
                        return name.Contains(_search, StringComparison.OrdinalIgnoreCase)
                            || emoji.Metadata.Keywords.Any(
                                k => k.Contains(_search, StringComparison.OrdinalIgnoreCase));
                    })
                    .ToDictionary(
                        kvp => kvp.Key, kvp => kvp.Value);
        }
    }

    [Inject]
    private EmojiService EmojiService { get; set; } = null!;

    protected override async Task OnInitializedAsync()
    {
        _emoji = await EmojiService.GetAllEmojiAsync();
    }
}
