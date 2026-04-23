{
  description = "Babylon + Flask + Open3D dev env";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          pkgs.python311
          pkgs.nodejs
          pkgs.cmake
          pkgs.stdenv.cc.cc.lib
        # runtime libs for pip wheels
        pkgs.stdenv.cc.cc.lib
        pkgs.systemd
        pkgs.libGL
        pkgs.libGLU
        pkgs.mesa
            # Open3D runtime deps
        pkgs.libGL
        pkgs.libX11
        pkgs.libXrandr
        pkgs.libXcursor
        pkgs.libXi
        pkgs.libXinerama
        pkgs.zlib
        pkgs.libxcb
        pkgs.glib

        ];

      shellHook = ''
        export LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath [
          pkgs.stdenv.cc.cc.lib
          pkgs.libGL
          pkgs.systemd
          pkgs.libGLU
          pkgs.mesa
          pkgs.libX11
          pkgs.libXrandr
          pkgs.libXcursor
          pkgs.libXi
          pkgs.libXinerama
          pkgs.zlib
          pkgs.libxcb
          pkgs.glib
        ]}:$LD_LIBRARY_PATH

        echo "Dev environment ready"
      '';
      };
    };
}
