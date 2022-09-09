// Copyright (c) David Pine. All rights reserved.
// Licensed under the MIT License.

namespace FluentUi.Emoji.Client.Services;

public sealed class EmojiService
{
    const string AllCacheKey = "All Emoji";

    private readonly HttpClient _client;
    private readonly IMemoryCache _cache;

    public EmojiService(HttpClient client, IMemoryCache cache) =>
        (_client, _cache) = (client, cache);

    public Task<Dictionary<string, EmojiDetails>> GetAllEmojiAsync() =>
        _cache.GetOrCreateAsync(
            AllCacheKey,
            _ => _client.GetFromJsonAsync<Dictionary<string, EmojiDetails>>(
                "emoji/all.g.json"))!;
}
