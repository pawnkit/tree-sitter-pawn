#define DOUBLE(%0) ((%0) * 2)

forward OnReady(value);

enum Status {
    Status_Ready
}

new global_value;

public OnReady(value) {
    DOUBLE(value);
}
