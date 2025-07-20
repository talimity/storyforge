{
  description = "Node 20 + TS dev env (no node_modules in Nix)";
  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-24.11";   # pick a channel/tag
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_20           # LTS as of Jul 2025
            pkgs.nodePackages.pnpm
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.eslint
          ];

          # keep pnpm’s global cache inside the project (optional)
          shellHook = ''
            export PNPM_HOME="$PWD/.pnpm-bin"
            export PATH="$PNPM_HOME:$PATH"

            echo "NodeJS devshell ready."
          '';
        };
      });
}
