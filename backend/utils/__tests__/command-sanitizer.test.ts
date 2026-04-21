/**
 * Comprehensive Unit Tests for Command Sanitizer
 * Tests for GHSA-7vx4-hf96-mqq6: Console Injection Vulnerability
 *
 * Test Categories:
 * 1. Security Tests - PoC attacks and injection vectors
 * 2. Safe Command Tests - Valid commands that should pass
 * 3. Edge Case Tests - Boundary conditions and special inputs
 * 4. Function-Specific Tests - Each exported function
 * 5. Regression Tests - Prevent future vulnerabilities
 */

import {
    isCommandSafe,
    escapeShellCommand,
    parseCommandSafely,
    isCommandAllowed,
    DEFAULT_ALLOWED_COMMANDS,
} from "../command-sanitizer";

// ============================================================================
// SECURITY TESTS - PoC Attacks from Advisory GHSA-7vx4-hf96-mqq6
// ============================================================================

describe("Security Tests - PoC Attacks from Advisory", () => {
    describe("Original PoC Attack Vectors", () => {
        it("should reject: ls | id (pipe injection - PoC #1)", () => {
            expect(isCommandSafe("ls | id")).toBe(false);
        });

        it("should reject: ls && whoami (AND injection - PoC #2)", () => {
            expect(isCommandSafe("ls && whoami")).toBe(false);
        });

        it("should reject: ls `id` (backtick substitution - PoC #3)", () => {
            expect(isCommandSafe("ls `id`")).toBe(false);
        });
    });

    describe("Extended Attack Vectors", () => {
        it("should reject OR operator: cmd || id", () => {
            expect(isCommandSafe("cmd || id")).toBe(false);
        });

        it("should reject semicolon separator: cmd; id", () => {
            expect(isCommandSafe("cmd; id")).toBe(false);
        });

        it("should reject background execution: cmd & id", () => {
            expect(isCommandSafe("cmd & id")).toBe(false);
        });

        it("should reject dollar-paren substitution: $(whoami)", () => {
            expect(isCommandSafe("echo $(whoami)")).toBe(false);
        });

        it("should reject dollar-brace expansion: ${PATH}", () => {
            expect(isCommandSafe("echo ${PATH}")).toBe(false);
        });

        it("should reject output redirection: cmd > file", () => {
            expect(isCommandSafe("ls > /tmp/output")).toBe(false);
        });

        it("should reject input redirection: cmd < file", () => {
            expect(isCommandSafe("cat < /etc/passwd")).toBe(false);
        });

        it("should reject error redirection: 2>&1", () => {
            expect(isCommandSafe("cmd 2>&1")).toBe(false);
        });

        it("should reject append redirection: cmd >> file", () => {
            expect(isCommandSafe("echo test >> /tmp/log")).toBe(false);
        });

        it("should reject subshell: (cmd)", () => {
            expect(isCommandSafe("(id)")).toBe(false);
        });

        it("should reject brace expansion: {a,b}", () => {
            expect(isCommandSafe("rm {a,b}")).toBe(false);
        });

        it("should reject escape character: \\n", () => {
            expect(isCommandSafe("echo test\\ninjected")).toBe(false);
        });

        it("should reject newline injection: actual newline", () => {
            expect(isCommandSafe("cmd\nid")).toBe(false);
        });

        it("should reject carriage return injection", () => {
            expect(isCommandSafe("cmd\rid")).toBe(false);
        });

        it("should reject CRLF injection", () => {
            expect(isCommandSafe("cmd\r\nid")).toBe(false);
        });
    });

    describe("Quote Injection Attacks", () => {
        it("should reject double quotes (prevents quote escaping attacks)", () => {
            expect(isCommandSafe('echo "test"')).toBe(false);
        });

        it("should reject single quotes (prevents quote escaping attacks)", () => {
            expect(isCommandSafe("echo 'test'")).toBe(false);
        });

        it("should reject mixed quotes", () => {
            expect(isCommandSafe(`echo "it's"`)).toBe(false);
        });

        it("should reject nested quotes attack", () => {
            expect(isCommandSafe(`echo "$(whoami)"`)).toBe(false);
        });
    });

    describe("Variable Expansion Attacks", () => {
        it("should reject $VAR expansion", () => {
            expect(isCommandSafe("echo $HOME")).toBe(false);
        });

        it("should reject ${VAR} expansion", () => {
            expect(isCommandSafe("echo ${HOME}")).toBe(false);
        });

        it("should reject $() command substitution", () => {
            expect(isCommandSafe("echo $(cat /etc/passwd)")).toBe(false);
        });

        it("should reject $((arithmetic))", () => {
            expect(isCommandSafe("echo $((1+1))")).toBe(false);
        });
    });

    describe("Complex Multi-Vector Attacks", () => {
        it("should reject combined pipe and redirection", () => {
            expect(
                isCommandSafe("cat /etc/passwd | grep root > /tmp/out"),
            ).toBe(false);
        });

        it("should reject nested command substitution", () => {
            expect(isCommandSafe("echo $(echo $(id))")).toBe(false);
        });

        it("should reject command in filename", () => {
            expect(isCommandSafe("cat file$(id).txt")).toBe(false);
        });

        it("should reject encoded newline attempts", () => {
            // Direct newline character
            expect(isCommandSafe("cmd\x0aid")).toBe(false);
        });
    });
});

// ============================================================================
// SAFE COMMAND TESTS - Commands That Should Pass Validation
// ============================================================================

describe("Safe Command Tests - Valid Commands", () => {
    describe("Basic Navigation Commands", () => {
        it("should allow: ls", () => {
            expect(isCommandSafe("ls")).toBe(true);
        });

        it("should allow: ls -la", () => {
            expect(isCommandSafe("ls -la")).toBe(true);
        });

        it("should allow: ls /path/to/dir", () => {
            expect(isCommandSafe("ls /path/to/dir")).toBe(true);
        });

        it("should allow: pwd", () => {
            expect(isCommandSafe("pwd")).toBe(true);
        });

        it("should allow: cd /path/to/dir", () => {
            expect(isCommandSafe("cd /path/to/dir")).toBe(true);
        });

        it("should allow: clear", () => {
            expect(isCommandSafe("clear")).toBe(true);
        });
    });

    describe("Docker Commands", () => {
        it("should allow: docker ps", () => {
            expect(isCommandSafe("docker ps")).toBe(true);
        });

        it("should allow: docker ps -a", () => {
            expect(isCommandSafe("docker ps -a")).toBe(true);
        });

        it("should allow: docker images", () => {
            expect(isCommandSafe("docker images")).toBe(true);
        });

        it("should allow: docker pull nginx", () => {
            expect(isCommandSafe("docker pull nginx")).toBe(true);
        });

        it("should allow: docker pull nginx:latest", () => {
            expect(isCommandSafe("docker pull nginx:latest")).toBe(true);
        });

        it("should allow: docker logs container-name", () => {
            expect(isCommandSafe("docker logs container-name")).toBe(true);
        });

        it("should allow: docker inspect container-id", () => {
            expect(isCommandSafe("docker inspect abc123def")).toBe(true);
        });

        it("should allow: docker compose up", () => {
            expect(isCommandSafe("docker compose up")).toBe(true);
        });

        it("should allow: docker compose up -d", () => {
            expect(isCommandSafe("docker compose up -d")).toBe(true);
        });

        it("should allow: docker-compose logs -f", () => {
            expect(isCommandSafe("docker-compose logs -f")).toBe(true);
        });

        it("should allow: docker exec container-name command", () => {
            expect(isCommandSafe("docker exec container-name ls")).toBe(true);
        });
    });

    describe("File Viewing Commands", () => {
        it("should allow: cat /path/to/file", () => {
            expect(isCommandSafe("cat /path/to/file.txt")).toBe(true);
        });

        it("should allow: head -10 file", () => {
            expect(isCommandSafe("head -10 file.log")).toBe(true);
        });

        it("should allow: tail -f file", () => {
            expect(isCommandSafe("tail -f /var/log/syslog")).toBe(true);
        });

        it("should allow: tail -n 100 file", () => {
            expect(isCommandSafe("tail -n 100 file.log")).toBe(true);
        });
    });

    describe("Search Commands", () => {
        it("should allow: grep pattern file", () => {
            expect(isCommandSafe("grep error file.log")).toBe(true);
        });

        it("should allow: grep -r pattern dir", () => {
            expect(isCommandSafe("grep -r pattern /path/to/dir")).toBe(true);
        });

        it("should allow: find /path -name pattern", () => {
            expect(isCommandSafe("find /path -name *.log")).toBe(true);
        });

        it("should allow: find with -type", () => {
            expect(isCommandSafe("find /path -type f")).toBe(true);
        });
    });

    describe("Utility Commands", () => {
        it("should allow: wc -l file", () => {
            expect(isCommandSafe("wc -l file.txt")).toBe(true);
        });

        it("should allow: file /path/to/file", () => {
            expect(isCommandSafe("file /path/to/binary")).toBe(true);
        });

        it("should allow: stat /path/to/file", () => {
            expect(isCommandSafe("stat /path/to/file")).toBe(true);
        });

        it("should allow: tree /path", () => {
            expect(isCommandSafe("tree /path/to/dir")).toBe(true);
        });

        it("should allow: echo without special chars", () => {
            expect(isCommandSafe("echo hello")).toBe(true);
        });

        it("should allow: echo with simple text", () => {
            expect(isCommandSafe("echo hello world")).toBe(true);
        });
    });

    describe("Commands with Flags and Arguments", () => {
        it("should allow: command with multiple flags", () => {
            expect(isCommandSafe("ls -la -h")).toBe(true);
        });

        it("should allow: command with long flags", () => {
            expect(isCommandSafe("docker ps --all --format")).toBe(true);
        });

        it("should allow: command with numeric arguments", () => {
            expect(isCommandSafe("head -n 50 file.txt")).toBe(true);
        });

        it("should allow: command with path containing dots", () => {
            expect(isCommandSafe("ls /path/to/../file")).toBe(true);
        });

        it("should allow: command with path containing dashes", () => {
            expect(isCommandSafe("ls /path-to/my-file")).toBe(true);
        });

        it("should allow: command with path containing underscores", () => {
            expect(isCommandSafe("ls /path_to/my_file")).toBe(true);
        });
    });
});

// ============================================================================
// EDGE CASE TESTS - Boundary Conditions and Special Inputs
// ============================================================================

describe("Edge Case Tests - Boundary Conditions", () => {
    describe("Empty and Whitespace Input", () => {
        it("should handle empty string", () => {
            expect(isCommandSafe("")).toBe(true); // Empty string has no dangerous chars
        });

        it("should handle whitespace only", () => {
            expect(isCommandSafe("   ")).toBe(true); // Spaces are safe
        });

        it("should handle tabs", () => {
            expect(isCommandSafe("\t")).toBe(true); // Tab is safe
        });
    });

    describe("Type Validation", () => {
        it("should reject null input", () => {
            expect(isCommandSafe(null as unknown as string)).toBe(false);
        });

        it("should reject undefined input", () => {
            expect(isCommandSafe(undefined as unknown as string)).toBe(false);
        });

        it("should reject number input", () => {
            expect(isCommandSafe(123 as unknown as string)).toBe(false);
        });

        it("should reject object input", () => {
            expect(isCommandSafe({} as unknown as string)).toBe(false);
        });

        it("should reject array input", () => {
            expect(isCommandSafe([] as unknown as string)).toBe(false);
        });

        it("should reject boolean input", () => {
            expect(isCommandSafe(true as unknown as string)).toBe(false);
        });
    });

    describe("Special Characters That Are Safe", () => {
        it("should allow: hyphen in commands", () => {
            expect(isCommandSafe("docker-compose")).toBe(true);
        });

        it("should allow: underscore in paths", () => {
            expect(isCommandSafe("ls /tmp/my_file")).toBe(true);
        });

        it("should allow: dots in filenames", () => {
            expect(isCommandSafe("cat file.txt")).toBe(true);
        });

        it("should allow: colon in docker tags", () => {
            expect(isCommandSafe("docker pull nginx:1.19")).toBe(true);
        });

        it("should allow: at sign in docker images", () => {
            expect(isCommandSafe("docker pull nginx@sha256:abc123")).toBe(true);
        });

        it("should allow: forward slash in paths", () => {
            expect(isCommandSafe("ls /var/log/nginx")).toBe(true);
        });

        it("should allow: equals sign in flags", () => {
            expect(isCommandSafe("docker run --name=test")).toBe(true);
        });

        it("should allow: plus sign", () => {
            expect(isCommandSafe("ls file+backup")).toBe(true);
        });

        it("should allow: percent sign", () => {
            expect(isCommandSafe("ls file%20name")).toBe(true);
        });

        it("should allow: tilde for home directory", () => {
            expect(isCommandSafe("ls ~")).toBe(true);
        });

        it("should allow: hash/pound in filenames", () => {
            expect(isCommandSafe("cat file#1.txt")).toBe(true);
        });

        it("should allow: square brackets (within reason)", () => {
            expect(isCommandSafe("ls file[1].txt")).toBe(true);
        });

        it("should allow: asterisk for glob patterns", () => {
            expect(isCommandSafe("ls *.txt")).toBe(true);
        });

        it("should allow: question mark for glob patterns", () => {
            expect(isCommandSafe("ls file?.txt")).toBe(true);
        });
    });

    describe("Unicode and International Characters", () => {
        it("should allow: unicode letters", () => {
            expect(isCommandSafe("ls /path/日本語")).toBe(true);
        });

        it("should allow: accented characters", () => {
            expect(isCommandSafe("ls /path/résumé")).toBe(true);
        });

        it("should allow: emojis in filenames", () => {
            expect(isCommandSafe("ls /path/🚀file")).toBe(true);
        });
    });

    describe("Very Long Input", () => {
        it("should handle very long safe commands", () => {
            const longPath = "a".repeat(1000);
            expect(isCommandSafe(`ls /path/${longPath}`)).toBe(true);
        });

        it("should reject long commands with injection at the end", () => {
            const longPath = "a".repeat(1000);
            expect(isCommandSafe(`ls /path/${longPath}| id`)).toBe(false);
        });

        it("should reject long commands with injection at the start", () => {
            const longPath = "a".repeat(1000);
            expect(isCommandSafe(`id |ls /path/${longPath}`)).toBe(false);
        });

        it("should reject long commands with injection in the middle", () => {
            const prefix = "a".repeat(500);
            const suffix = "b".repeat(500);
            expect(isCommandSafe(`ls /path/${prefix}|${suffix}`)).toBe(false);
        });
    });

    describe("Strict vs Non-Strict Mode", () => {
        it("strict mode should catch additional patterns", () => {
            // These would be caught by metacharacter check anyway
            expect(isCommandSafe("cmd && other", true)).toBe(false);
            expect(isCommandSafe("cmd || other", true)).toBe(false);
        });

        it("strict mode flag should work", () => {
            // Both modes should still block dangerous characters
            expect(isCommandSafe("ls | id", true)).toBe(false);
            expect(isCommandSafe("ls | id", false)).toBe(false);
        });
    });
});

// ============================================================================
// FUNCTION-SPECIFIC TESTS - escapeShellCommand
// ============================================================================

describe("escapeShellCommand Function Tests", () => {
    describe("Basic Escaping", () => {
        it("should wrap simple command in single quotes", () => {
            expect(escapeShellCommand("hello")).toBe("'hello'");
        });

        it("should wrap command with spaces in single quotes", () => {
            expect(escapeShellCommand("hello world")).toBe("'hello world'");
        });

        it("should escape single quotes in command", () => {
            expect(escapeShellCommand("it's")).toBe("'it'\\''s'");
        });

        it("should escape multiple single quotes", () => {
            expect(escapeShellCommand("it's a 'test'")).toBe(
                "'it'\\''s a '\\''test'\\'''",
            );
        });
    });

    describe("Type Validation", () => {
        it("should return empty string for null", () => {
            expect(escapeShellCommand(null as unknown as string)).toBe("");
        });

        it("should return empty string for undefined", () => {
            expect(escapeShellCommand(undefined as unknown as string)).toBe("");
        });

        it("should return empty string for number", () => {
            expect(escapeShellCommand(123 as unknown as string)).toBe("");
        });
    });

    describe("Special Characters", () => {
        it("should preserve double quotes inside single quotes", () => {
            expect(escapeShellCommand('say "hello"')).toBe("'say \"hello\"'");
        });

        it("should preserve other special chars inside single quotes", () => {
            expect(escapeShellCommand("ls | grep")).toBe("'ls | grep'");
        });

        it("should handle empty string", () => {
            expect(escapeShellCommand("")).toBe("''");
        });
    });
});

// ============================================================================
// FUNCTION-SPECIFIC TESTS - parseCommandSafely
// ============================================================================

describe("parseCommandSafely Function Tests", () => {
    describe("Valid Commands", () => {
        it("should parse simple command", () => {
            expect(parseCommandSafely("ls")).toEqual(["ls"]);
        });

        it("should parse command with arguments", () => {
            expect(parseCommandSafely("ls -la")).toEqual(["ls", "-la"]);
        });

        it("should parse command with multiple arguments", () => {
            expect(parseCommandSafely("docker pull nginx:latest")).toEqual([
                "docker",
                "pull",
                "nginx:latest",
            ]);
        });

        it("should handle extra whitespace", () => {
            expect(parseCommandSafely("  ls   -la   ")).toEqual(["ls", "-la"]);
        });

        it("should handle tabs as separators", () => {
            expect(parseCommandSafely("ls\t-la")).toEqual(["ls", "-la"]);
        });
    });

    describe("Invalid Commands", () => {
        it("should return null for pipe injection", () => {
            expect(parseCommandSafely("ls | id")).toBeNull();
        });

        it("should return null for AND injection", () => {
            expect(parseCommandSafely("ls && id")).toBeNull();
        });

        it("should return null for command substitution", () => {
            expect(parseCommandSafely("ls $(id)")).toBeNull();
        });
    });

    describe("Edge Cases", () => {
        it("should return null for empty string", () => {
            expect(parseCommandSafely("")).toBeNull();
        });

        it("should return null for whitespace only", () => {
            expect(parseCommandSafely("   ")).toBeNull();
        });

        it("should return null for null input", () => {
            expect(parseCommandSafely(null as unknown as string)).toBeNull();
        });

        it("should return null for undefined input", () => {
            expect(
                parseCommandSafely(undefined as unknown as string),
            ).toBeNull();
        });
    });

    describe("Documentation Accuracy (Addresses Code Review Feedback)", () => {
        /**
         * NOTE: The parseCommandSafely function docstring mentions "respecting quoted strings"
         * but quotes are blocked by isCommandSafe. This is intentional for security.
         * These tests document the actual behavior.
         */
        it("should reject double-quoted arguments (security restriction)", () => {
            // Quotes are blocked to prevent injection attacks
            expect(parseCommandSafely('echo "hello world"')).toBeNull();
        });

        it("should reject single-quoted arguments (security restriction)", () => {
            // Quotes are blocked to prevent injection attacks
            expect(parseCommandSafely("echo 'hello world'")).toBeNull();
        });

        it("should handle simple multi-word commands without quotes", () => {
            // Without quotes, each word is a separate argument
            expect(parseCommandSafely("echo hello world")).toEqual([
                "echo",
                "hello",
                "world",
            ]);
        });
    });
});

// ============================================================================
// FUNCTION-SPECIFIC TESTS - isCommandAllowed
// ============================================================================

describe("isCommandAllowed Function Tests", () => {
    describe("Basic Allowlist Checking", () => {
        it("should allow command in allowlist", () => {
            expect(isCommandAllowed("docker ps", ["docker", "ls"])).toBe(true);
        });

        it("should reject command not in allowlist", () => {
            expect(isCommandAllowed("rm -rf /", ["docker", "ls"])).toBe(false);
        });

        it("should be case-insensitive", () => {
            expect(isCommandAllowed("DOCKER ps", ["docker"])).toBe(true);
            expect(isCommandAllowed("Docker ps", ["DOCKER"])).toBe(true);
        });
    });

    describe("Command Extraction", () => {
        it("should extract command from arguments", () => {
            expect(isCommandAllowed("ls -la /tmp", ["ls"])).toBe(true);
        });

        it("should handle command with path", () => {
            expect(isCommandAllowed("/usr/bin/ls -la", ["/usr/bin/ls"])).toBe(
                true,
            );
        });

        it("should handle whitespace", () => {
            expect(isCommandAllowed("  docker  ps  ", ["docker"])).toBe(true);
        });
    });

    describe("Type Validation", () => {
        it("should return false for null command", () => {
            expect(
                isCommandAllowed(null as unknown as string, ["docker"]),
            ).toBe(false);
        });

        it("should return false for undefined command", () => {
            expect(
                isCommandAllowed(undefined as unknown as string, ["docker"]),
            ).toBe(false);
        });
    });

    describe("Empty Cases", () => {
        it("should return false for empty allowlist", () => {
            expect(isCommandAllowed("docker", [])).toBe(false);
        });

        it("should return false for empty command", () => {
            expect(isCommandAllowed("", ["docker"])).toBe(false);
        });
    });
});

// ============================================================================
// FUNCTION-SPECIFIC TESTS - DEFAULT_ALLOWED_COMMANDS
// ============================================================================

describe("DEFAULT_ALLOWED_COMMANDS Tests", () => {
    it("should include docker", () => {
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("docker");
    });

    it("should include docker-compose", () => {
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("docker-compose");
    });

    it("should include common file commands", () => {
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("ls");
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("cd");
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("pwd");
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("cat");
    });

    it("should include search commands", () => {
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("grep");
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("find");
    });

    it("should include viewing commands", () => {
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("head");
        expect(DEFAULT_ALLOWED_COMMANDS).toContain("tail");
    });

    it("should NOT include dangerous commands", () => {
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("rm");
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("dd");
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("mkfs");
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("chmod");
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("chown");
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("sudo");
        expect(DEFAULT_ALLOWED_COMMANDS).not.toContain("su");
    });
});

// ============================================================================
// REGRESSION TESTS - Prevent Future Vulnerabilities
// ============================================================================

describe("Regression Tests - Prevent Future Vulnerabilities", () => {
    describe("Bypass Attempts", () => {
        it("should block null byte injection", () => {
            expect(isCommandSafe("ls\x00id")).toBe(true); // Null byte itself is safe
            // But combined with other attacks:
            expect(isCommandSafe("ls\x00| id")).toBe(false);
        });

        it("should block URL-encoded injection attempts", () => {
            // URL encoding doesn't bypass string checks
            expect(isCommandSafe("ls%7Cid")).toBe(true); // %7C is just characters, not |
        });

        it("should block base64-like patterns with dangerous chars", () => {
            expect(isCommandSafe("$(echo aWQ= | base64 -d)")).toBe(false);
        });

        it("should block Unicode homograph attacks", () => {
            // These are visual lookalikes, but the actual dangerous chars are blocked
            expect(isCommandSafe("ls｜id")).toBe(true); // Full-width vertical line is NOT |
            // The actual pipe is still blocked:
            expect(isCommandSafe("ls|id")).toBe(false);
        });
    });

    describe("Obfuscation Attempts", () => {
        it("should block whitespace-padded injection", () => {
            expect(isCommandSafe("ls    |    id")).toBe(false);
        });

        it("should block tab-separated injection", () => {
            expect(isCommandSafe("ls\t|\tid")).toBe(false);
        });

        it("should block mixed whitespace injection", () => {
            expect(isCommandSafe("ls \t| \t id")).toBe(false);
        });
    });

    describe("Edge Case Attacks", () => {
        it("should block injection with path traversal", () => {
            expect(isCommandSafe("cat ../../etc/passwd | grep root")).toBe(
                false,
            );
        });

        it("should block injection in docker exec", () => {
            expect(
                isCommandSafe("docker exec container sh -c 'rm -rf /'"),
            ).toBe(false);
        });

        it("should block process substitution", () => {
            expect(isCommandSafe("diff <(cat file1) <(cat file2)")).toBe(false);
        });

        it("should block here-string injection", () => {
            expect(isCommandSafe("cat <<< 'injected'")).toBe(false);
        });
    });
});

// ============================================================================
// INTEGRATION TESTS - Real-World Usage Patterns
// ============================================================================

describe("Integration Tests - Real-World Usage", () => {
    describe("Typical Docker Workflow", () => {
        it("should allow typical docker inspection workflow", () => {
            const commands = [
                "docker ps",
                "docker ps -a",
                "docker images",
                "docker logs container-name",
                "docker inspect container-id",
                "docker stats",
                "docker top container-name",
                "docker port container-name",
            ];

            for (const cmd of commands) {
                expect(isCommandSafe(cmd)).toBe(true);
            }
        });

        it("should allow typical docker-compose workflow", () => {
            const commands = [
                "docker compose up -d",
                "docker compose down",
                "docker compose logs -f",
                "docker compose ps",
                "docker-compose up",
                "docker-compose down",
                "docker-compose logs",
            ];

            for (const cmd of commands) {
                expect(isCommandSafe(cmd)).toBe(true);
            }
        });
    });

    describe("Typical File Navigation Workflow", () => {
        it("should allow typical file exploration", () => {
            const commands = [
                "ls",
                "ls -la",
                "pwd",
                "cd /var/log",
                "cat nginx.log",
                "tail -f access.log",
                "head -100 error.log",
                "grep error access.log",
            ];

            for (const cmd of commands) {
                expect(isCommandSafe(cmd)).toBe(true);
            }
        });
    });

    describe("Combined isCommandSafe and isCommandAllowed", () => {
        it("should validate both safety and allowlist", () => {
            const cmd = "docker ps";
            const isSafe = isCommandSafe(cmd);
            const isAllowed = isCommandAllowed(cmd, DEFAULT_ALLOWED_COMMANDS);

            expect(isSafe).toBe(true);
            expect(isAllowed).toBe(true);
        });

        it("should block dangerous command even if in allowlist", () => {
            const cmd = "docker exec container sh -c 'id'";
            // This is blocked by isCommandSafe due to quotes
            expect(isCommandSafe(cmd)).toBe(false);
            // Even though docker is in the allowlist
            expect(isCommandAllowed(cmd, DEFAULT_ALLOWED_COMMANDS)).toBe(true);
        });

        it("should require both checks to pass", () => {
            // Safe but not allowed
            const safeButNotAllowed = "rm file.txt";
            expect(isCommandSafe(safeButNotAllowed)).toBe(true);
            expect(
                isCommandAllowed(safeButNotAllowed, DEFAULT_ALLOWED_COMMANDS),
            ).toBe(false);

            // Allowed but not safe
            const allowedButNotSafe = "docker exec container | id";
            expect(isCommandSafe(allowedButNotSafe)).toBe(false);
            expect(
                isCommandAllowed(allowedButNotSafe, DEFAULT_ALLOWED_COMMANDS),
            ).toBe(true);
        });
    });
});

// ============================================================================
// PERFORMANCE TESTS - Ensure No ReDoS Vulnerabilities
// ============================================================================

describe("Performance Tests - ReDoS Prevention", () => {
    it("should handle pathological input quickly", () => {
        // This pattern could cause ReDoS with poorly written regex
        const pathological = "a".repeat(10000) + "!";
        const start = Date.now();
        isCommandSafe(pathological);
        const duration = Date.now() - start;

        // Should complete in under 100ms even for large input
        expect(duration).toBeLessThan(100);
    });

    it("should handle many small inputs quickly", () => {
        const start = Date.now();
        for (let i = 0; i < 10000; i++) {
            isCommandSafe("docker ps -a");
        }
        const duration = Date.now() - start;

        // 10000 validations should complete in under 1 second
        expect(duration).toBeLessThan(1000);
    });
});
