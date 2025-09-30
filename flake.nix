{
  description = "Node 24 development environment with pnpm, TypeScript, and ESLint";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      nixpkgs-unstable,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        pkgsUnstable = import nixpkgs-unstable { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pkgsUnstable.nodePackages.pnpm
            nodePackages.typescript-language-server
            pkgsUnstable.biome
          ];

          # keep pnpm’s global cache inside the project
          shellHook = ''
            export PNPM_HOME="$PWD/.pnpm-bin"
            export BIOME_BINARY=${pkgsUnstable.biome}/bin/biome
            export PATH="$PNPM_HOME:$PATH"
          '';
        };
      }
    );
}
