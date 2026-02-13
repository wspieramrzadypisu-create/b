#!/usr/bin/env python3
# SPDX-License-Identifier: EUPL-1.2
# SPDX-FileCopyrightText: 2025-2026 Damian Fajfer <damian@fajfer.org>
#
# AI generated Mon Dec 29 19:13:14 CET 2025 using Claude Sonnet 4.5

"""
Script to remove line numbers from files in the repository.
This script will:
1. Find all text files in the repository
2. Remove line numbers at the beginning of each line (pattern: "1    content")
3. Remove trailing whitespace from each line
4. Remove excessive blank lines (more than 2 consecutive)
5. Optionally rename .html files to their proper extensions
"""

import os
import re
import sys
from pathlib import Path


# Directories to skip
SKIP_DIRS = {'.git', '__pycache__', 'node_modules', '.venv', 'venv', 'build', 'dist'}

# Binary file extensions to skip
BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
    '.pdf', '.zip', '.tar', '.gz', '.bz2', '.xz',
    '.exe', '.dll', '.so', '.dylib', '.a',
    '.mp3', '.mp4', '.avi', '.mov', '.wav',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.class', '.jar', '.war', '.ear',
    '.pyc', '.pyo', '.pyd',
}


def is_text_file(file_path):
    """Check if a file is likely a text file."""
    # Skip files with binary extensions
    if file_path.suffix.lower() in BINARY_EXTENSIONS:
        return False
    
    # Try to read the file as text
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            f.read(1024)  # Read first 1KB
        return True
    except (UnicodeDecodeError, PermissionError):
        return False


def has_line_numbers(content):
    """Check if content has line numbers at the beginning of lines."""
    lines = content.split('\n')
    if len(lines) < 2:
        return False
    
    # Check if first few lines match the pattern "number    content"
    matches = 0
    for i, line in enumerate(lines[:min(10, len(lines))]):
        # Pattern: one or more digits, followed by whitespace
        if re.match(r'^\d+\s+', line) or (line.strip() == str(i + 1)):
            matches += 1
    
    # If more than 50% of checked lines have numbers, consider it numbered
    return matches >= min(5, len(lines) * 0.5)


def get_line_number_format(content):
    """
    Analyze the line number format in the content.
    Returns (max_line_number, spacing_after_max) tuple.
    """
    lines = content.split('\n')
    max_num = 0
    max_line_idx = -1
    
    # Find the maximum line number and its position
    for idx, line in enumerate(lines):
        match = re.match(r'^(\d+)\s+', line)
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num
                max_line_idx = idx
    
    if max_num == 0:
        return 0, 0
    
    # Analyze the line with the maximum line number to determine spacing
    max_line = lines[max_line_idx]
    # Match: line number, then count the spaces after it
    match = re.match(r'^(\d+)(\s+)', max_line)
    if match:
        spaces_after = len(match.group(2))
        return max_num, spaces_after
    
    return max_num, 3  # Default to 3 if we can't determine


def remove_line_numbers(content):
    """
    Remove line numbers from the beginning of each line, preserving original indentation.
    
    The format is: line numbers are aligned with padding, followed by N spaces (detected).
    For example, if max line is 10 (2 digits) and spacing is 3:
    - Line 1:  "1    " (1 digit + 4 spaces = 5 chars total)
    - Line 10: "10   " (2 digits + 3 spaces = 5 chars total)
    
    Total width = len(str(max_line_number)) + detected_spacing
    """
    lines = content.split('\n')
    
    # Detect the line number format
    max_line_num, spacing = get_line_number_format(content)
    if max_line_num == 0:
        # No line numbers found, return as is
        return content
    
    # Calculate the total width: digits of max number + detected spacing
    total_width = len(str(max_line_num)) + spacing
    
    cleaned_lines = []
    for line in lines:
        # Check if line starts with a number
        match = re.match(r'^(\d+)', line)
        if match and len(line) > total_width:
            # Remove exactly the calculated width from the beginning
            cleaned_line = line[total_width:].rstrip()
        elif match and len(line) <= total_width:
            # Line is just the line number (empty line)
            cleaned_line = ''
        else:
            # No line number, keep as is but remove trailing whitespace
            cleaned_line = line.rstrip()
        
        cleaned_lines.append(cleaned_line)
    
    return '\n'.join(cleaned_lines)


def remove_excessive_blank_lines(content):
    """Remove more than 2 consecutive blank lines."""
    return re.sub(r'\n{4,}', '\n\n\n', content)


def process_file(file_path, dry_run=False):
    """Process a single file to remove line numbers."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        # Check if file has line numbers
        if not has_line_numbers(original_content):
            return False, "No line numbers detected"
        
        # Clean the content
        cleaned_content = remove_line_numbers(original_content)
        cleaned_content = remove_excessive_blank_lines(cleaned_content)
        
        # Ensure file ends with a single newline
        if cleaned_content and not cleaned_content.endswith('\n'):
            cleaned_content += '\n'
        
        # Write back if not dry run
        if not dry_run:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_content)
        
        return True, "Cleaned"
    
    except Exception as e:
        return False, f"Error: {str(e)}"


def rename_html_files(repo_path, dry_run=False):
    """Rename .html files to their proper extensions (e.g., Package.swift.html -> Package.swift)."""
    renamed = []
    for root, dirs, files in os.walk(repo_path):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        
        for file in files:
            if file.endswith('.html') and '.' in file[:-5]:  # Has another extension before .html
                old_path = Path(root) / file
                new_path = Path(root) / file[:-5]  # Remove .html extension
                
                if not dry_run:
                    old_path.rename(new_path)
                
                renamed.append((old_path, new_path))
    
    return renamed


def main():
    """Main function to process all files in the repository."""
    # Get repository root (current directory)
    repo_path = Path(__file__).parent
    
    # Parse command line arguments
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    rename_files = '--rename' in sys.argv or '-r' in sys.argv
    
    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified\n")
    
    print(f"📂 Processing repository: {repo_path}\n")
    
    # Rename .html files if requested
    if rename_files:
        print("📝 Renaming .html files...")
        renamed_files = rename_html_files(repo_path, dry_run)
        if renamed_files:
            for old, new in renamed_files:
                rel_old = old.relative_to(repo_path)
                rel_new = new.relative_to(repo_path)
                print(f"   {rel_old} → {rel_new}")
        else:
            print("   No files to rename")
        print()
    
    # Process all files
    processed_count = 0
    cleaned_count = 0
    error_count = 0
    
    for root, dirs, files in os.walk(repo_path):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        
        for file in files:
            # Skip this script itself
            if file == 'clean_line_numbers.py':
                continue
            
            file_path = Path(root) / file
            
            # Skip non-text files
            if not is_text_file(file_path):
                continue
            
            processed_count += 1
            relative_path = file_path.relative_to(repo_path)
            
            success, message = process_file(file_path, dry_run)
            
            if success:
                cleaned_count += 1
                print(f"✅ {relative_path}: {message}")
            elif "Error" in message:
                error_count += 1
                print(f"❌ {relative_path}: {message}")
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"   Files processed: {processed_count}")
    print(f"   Files cleaned: {cleaned_count}")
    print(f"   Errors: {error_count}")
    print(f"{'='*60}")
    
    if dry_run:
        print("\n💡 Run without --dry-run to apply changes")
    
    if rename_files and not dry_run:
        print("\n💡 Files have been renamed. You may want to update imports/references.")


if __name__ == "__main__":
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        print("\nUsage: python3 clean_line_numbers.py [OPTIONS]")
        print("\nOptions:")
        print("  -n, --dry-run    Preview changes without modifying files")
        print("  -r, --rename     Rename .html files to remove .html extension")
        print("  -h, --help       Show this help message")
        sys.exit(0)
    
    main()
