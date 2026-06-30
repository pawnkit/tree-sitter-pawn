#define DOUBLE(%0) ((%0) * 2)

public Float:scale(Float:value) {
    new result = DOUBLE(value);
    return result;
}
