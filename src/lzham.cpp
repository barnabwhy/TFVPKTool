#include <napi.h>
#include "lzham/include/lzham.h"

namespace lzham {
    static const lzham_uint32 tflzham_dict_size = 20; // required for compatibility

    static const lzham_compress_params tflzham_compress_params = {
	    .m_dict_size_log2     = tflzham_dict_size,
	    .m_level              = lzham_compress_level::LZHAM_COMP_LEVEL_UBER,
	    .m_max_helper_threads = -1,
	    .m_compress_flags     = lzham_compress_flags::LZHAM_COMP_FLAG_DETERMINISTIC_PARSING | lzham_compress_flags::LZHAM_COMP_FLAG_TRADEOFF_DECOMPRESSION_RATE_FOR_COMP_RATIO,
    };
    static const lzham_decompress_params tflzham_decompress_params = {
        .m_struct_size      = sizeof(lzham_decompress_params),
        .m_dict_size_log2   = tflzham_dict_size,
        .m_decompress_flags = lzham_decompress_flags::LZHAM_DECOMP_FLAG_OUTPUT_UNBUFFERED | lzham_decompress_flags::LZHAM_DECOMP_FLAG_COMPUTE_CRC32,
    };

    // NOT FINISHED IMPLEMENTING COMPRESSION YET
    // Napi::Value compress(const Napi::CallbackInfo& info) {
    //     Napi::Env env = info.Env();

    //     Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    //     Napi::Number n_dstLen = info[1].As<Napi::Number>();
    //     const uint8_t* src = buffer.Data();
    //     size_t srcLen = buffer.Length();
    //     size_t dstLen = n_dstLen.Uint32Value();
    //     lzham_uint32 adler32;
    //     lzham_uint32 crc32;

    //     uint8_t* dst = new uint8_t[dstLen];
    //     lzham_compress_status_t res = lzham_compress_memory(&tflzham_decompress_params, dst, &dstLen, src, srcLen, &adler32, &crc32);

    //     return Napi::Number::New(env, res);

    //     return Napi::Buffer<uint8_t>::New(env, dst, *dstLen);
    // }

    Napi::Value decompress(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
        Napi::Number n_dstLen = info[1].As<Napi::Number>();
        const uint8_t* src = buffer.Data();
        size_t srcLen = buffer.Length();
        size_t dstLen = n_dstLen.Uint32Value();
        lzham_uint32 adler32;
        lzham_uint32 crc32;

        uint8_t* dst = new uint8_t[dstLen];
        lzham_decompress_memory(&tflzham_decompress_params, dst, &dstLen, src, srcLen, &adler32, &crc32);

        // return Napi::Number::New(env, res);

        return Napi::Buffer<uint8_t>::New(env, dst, dstLen);
    }

    Napi::Value test(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        return Napi::String::New(env, "test");
    }

    Napi::Object init(Napi::Env env, Napi::Object exports) {
        // exports.Set(Napi::String::New(env, "compress"), Napi::Function::New(env, compress));
        exports.Set(Napi::String::New(env, "decompress"), Napi::Function::New(env, decompress));
        exports.Set(Napi::String::New(env, "test"), Napi::Function::New(env, test));
        return exports;
    };

    NODE_API_MODULE(lzham, init);
}