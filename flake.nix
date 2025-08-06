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

        # devctl is a utility script that allows Claude Code to manage dev
        # servers running in the background using tmux, so as to avoid it
        # blocking itself by running `pnpm dev` in the foreground.
        devctl = pkgs.writeShellScriptBin "devctl" ''
          #!/usr/bin/env bash
          set -euo pipefail

          SESSION="dev"
          CMD="''${1:-}"
          shift || true
          ARG="''${1:-}"

          if [[ -n "''${DEV_ROOT:-}" ]]; then
            ROOT="$DEV_ROOT"
          elif git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
            ROOT="$git_root"
          else
            echo "devctl: cannot determine repository root" >&2
            exit 1
          fi
          cd "$ROOT"

          have_session() { tmux has-session -t "$SESSION" 2>/dev/null; }
          tail_logs() {
            local lines="''${1:-50}"
            tmux capture-pane -t "$SESSION" -pJ -S - | awk 'NF' | tail -n "$lines"
          }

          case "$CMD" in
            start)
              if have_session; then
                echo "devctl: session '$SESSION' already running"
              else
                tmux new-session -d -s "$SESSION" 'pnpm dev'
                echo "devctl: started '$SESSION' in $ROOT"
              fi
              ;;
            stop)
              if have_session; then
                tmux kill-session -t "$SESSION"
                echo "devctl: stopped '$SESSION'"
              else
                echo "devctl: session '$SESSION' not running"
              fi
              ;;
            restart)
              "$0" stop
              "$0" start
              ;;
            status)
              if have_session; then
                echo "running"; exit 0
              else
                echo "stopped"; exit 1
              fi
              ;;
            logs)
              if have_session; then
                tail_logs "$ARG"
              else
                echo "devctl: session '$SESSION' not running" >&2
                exit 1
              fi
              ;;
            ""|-h|--help|help)
              cat <<EOF
          Usage: devctl <command> [arg]

            start           Launch 'pnpm dev' in tmux session '$SESSION'
            stop            Kill the session
            restart         stop -> start
            status          "running" or "stopped" (exit 0 if running)
            logs [N]        Show last N (default 50) log lines

          EOF
              ;;
            *)
              echo "devctl: unknown command '$CMD'" >&2
              exit 1
              ;;
          esac
        '';

      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            nodePackages.pnpm
            nodePackages.typescript-language-server
            nodePackages.eslint
            tmux
            devctl
            pkgsUnstable.biome
          ];

          # keep pnpm’s global cache inside the project
          shellHook = ''
            export PNPM_HOME="$PWD/.pnpm-bin"
            export BIOME_BINARY=${pkgsUnstable.biome}/bin/biome
            export PATH="$PNPM_HOME:$PATH"
            echo "NodeJS devshell ready.  You can now run: devctl start|stop|restart|status|logs"
          '';
        };
      }
    );
}
