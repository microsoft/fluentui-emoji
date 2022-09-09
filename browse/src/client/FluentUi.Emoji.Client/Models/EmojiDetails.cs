// Copyright (c) David Pine. All rights reserved.
// Licensed under the MIT License.

namespace FluentUi.Emoji.Client.Models;

public readonly record struct EmojiDetails(
    Metadata Metadata,
    string[] Routes,
    bool? HasVariations = null)
{
    public string? DefaultImage
    {
        get
        {
            var hasVariations = HasVariations.GetValueOrDefault();
            var imageRoute = Routes.FirstOrDefault(route =>
            {
                var routeSegment = hasVariations ? "/Default/" : "/3D/";
                return route.Contains(routeSegment, StringComparison.OrdinalIgnoreCase);
            });

            return imageRoute;
        }
    }
}
