#define DOUBLE(%0) ((%0) * 2)

forward OnReady(value);

Decorator Float:OnValue(value);

forward operator+(left, right);
forward @Callback();
native Module.Func();

enum Status {
    Status_Ready
}

new global_value;

public OnReady(value) {
    DOUBLE(value);
    Module.Func();
    @.Callback();
    handlers[0]();
}
