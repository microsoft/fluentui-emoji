// Copyright (c) David Pine. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Services;

public sealed class EmojiService(HttpClient client, IMemoryCache cache)
{
    const string AllCacheKey = "all-emoji";

    public Task<Dictionary<string, EmojiDetails>> GetAllEmojiAsync() =>
        cache.GetOrCreateAsync(
            AllCacheKey,
            _ => client.GetFromJsonAsync<Dictionary<string, EmojiDetails>>(
                "emoji/all.g.json"))!;
}
