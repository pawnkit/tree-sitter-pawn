stock Toggle(enabled) {
#if defined FEATURE
    if (enabled)
#else
    if (!enabled)
#endif
    {
        Apply(enabled);
    }
}
