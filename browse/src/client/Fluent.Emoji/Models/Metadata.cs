// Copyright (c) David Pine. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Models;

public record class Metadata(
    string Cldr,
    string FromVersion,
    string Glyph,
    string[] GlyphAsUtfInEmoticons,
    string Group,
    string[] Keywords,
    string[] MappedToEmoticons,
    string Tts,
    string Unicode);
