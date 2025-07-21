{
  description = "Node 24 development environment with pnpm, TypeScript, and ESLint";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pkgs.nodePackages.pnpm
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.eslint
          ];

          # keep pnpm’s global cache inside the project
          shellHook = ''
            export PNPM_HOME="$PWD/.pnpm-bin"
            export PATH="$PNPM_HOME:$PATH"

            echo "NodeJS devshell ready."
          '';
        };
      }
    );
}
