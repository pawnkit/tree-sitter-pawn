#define ADD(%0,%1) ((%0) + (%1))
#define TOKEN_PASTE(%0,%1) %0%1

#if defined FEATURE
stock Enabled() {
    AnyIterator(new item : Items) {
        Use(item);
    }
}
#else
stock Disabled() {}
#endif
