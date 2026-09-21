cmake_minimum_required(VERSION 3.13)
project(Hinge)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_library(Hinge SHARED)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/Hinge+autolinking.cmake)

target_sources(
  Hinge PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src/main/cpp/cpp-adapter.cpp
)
