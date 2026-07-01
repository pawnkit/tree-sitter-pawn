stock Float:Distance(Float:x, Float:y)
    return floatsqroot(x * x + y * y)

stock Process(const input[]) {
    new packed[] = !"text";
    for (new i = 0; i < sizeof packed; i++) {
        switch (packed[i]) {
            case 0 .. 10: continue;
            default: break;
        }
    }
}

enum ItemData {
    Float:ItemX,
    Float:ItemY,
    ItemName[32 char]
}
