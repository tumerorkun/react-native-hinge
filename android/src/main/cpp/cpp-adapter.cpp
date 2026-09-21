#include <jni.h>
#include "HingeOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::hinge::initialize(vm);
}
