{
  "targets": [
    {
      "target_name": "lzham",
      "sources": [
        "lzham.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<(module_root_dir)/lzham/include"
      ],
      'libraries': [
        '<(module_root_dir)/lzham/lib/liblzham_x64.lib'
      ],
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
      "cflags": [ "-fno-exceptions" ],
      "cflags_cc": [ "-fno-exceptions", "-std=c++20" ],
      "conditions": [
        ['OS=="mac"', {
            "xcode_settings": {
              'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
              "CLANG_CXX_LIBRARY": "libc++",
              "CLANG_CXX_LANGUAGE_STANDARD":"c++20",
              'MACOSX_DEPLOYMENT_TARGET': '10.14'
            }
        }],
        ['OS=="win"', {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": [ "-std:c++20", ],
            },
          },
        }]
      ]
    }
  ]
}