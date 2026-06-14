ARG WHISPER_CPP_VERSION="v1.8.6"

# Multi-stage build for whisper.wasm
FROM emscripten/emsdk:4.0.14 AS builder

# Set working directory
WORKDIR /src

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Clone whisper.cpp repository
ARG WHISPER_CPP_VERSION
RUN git clone --depth 1 --branch $WHISPER_CPP_VERSION https://github.com/ggml-org/whisper.cpp.git

WORKDIR /src/whisper.cpp
RUN mkdir build-em

WORKDIR /src/whisper.cpp/build-em

# Build whisper.wasm
# ENV EMCC_CFLAGS="-sMODULARIZE=1 -sEXPORT_ES6=1" 
RUN emcmake cmake .. -DCMAKE_EXE_LINKER_FLAGS="-sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web"

RUN make -j

# prepare for export
# docker build --target builder --output type=local,dest=./wasm-build .
WORKDIR /src/whisper.cpp/build-em

FROM scratch AS export-stage
COPY --from=builder /src/whisper.cpp/build-em/bin /
