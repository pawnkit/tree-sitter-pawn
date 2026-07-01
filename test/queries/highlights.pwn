#define DOUBLE(%0) ((%0) * 2)
#include <core>
#tryinclude "optional"
#if defined FEATURE
#elseif defined FALLBACK
#else
#endif
#pragma unused result

public Float:scale(Float:value) {
    new result = DOUBLE(value);
    Module.Func();
    @.Callback();
    handlers[0]();
    return result;
}

Decorator Float:OnValue(value);

forward operator+(left, right);
forward @Callback();
native Module.Func();
