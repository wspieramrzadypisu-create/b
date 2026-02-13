#!/usr/bin/env python3
# SPDX-License-Identifier: EUPL-1.2
# SPDX-FileCopyrightText: 2025-2026 Damian Fajfer <damian@fajfer.org>
"""
mObywatel Source Code Organizer

This script takes files downloaded from mObywatel code gallery 
(with path separators replaced by '__') and organizes them into 
a proper directory structure.

Usage:
    python organize_files.py [source_dir] [output_dir]
    
Arguments:
    source_dir  - Directory containing downloaded files (default: current directory)
    output_dir  - Directory where organized structure will be created (default: ./organized)

Example:
    python organize_files.py ~/Downloads ./mobywatel-source
"""

import os
import sys
import shutil
from pathlib import Path


def organize_files(source_dir: str = ".", output_dir: str = "organized") -> None:
    """
    Organize files with '__' path separators into proper directory structure.
    
    Args:
        source_dir: Directory containing the downloaded files
        output_dir: Directory where the organized structure will be created
    """
    source_path = Path(source_dir).resolve()
    output_path = Path(output_dir).resolve()
    
    if not source_path.exists():
        print(f"Error: Source directory '{source_path}' does not exist.")
        sys.exit(1)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all files with '__' in the name (indicating path structure)
    files_processed = 0
    files_skipped = 0
    
    print(f"Source directory: {source_path}")
    print(f"Output directory: {output_path}")
    print("-" * 50)
    
    for file in source_path.iterdir():
        if not file.is_file():
            continue
            
        filename = file.name
        
        # Skip the manifest file and hidden files
        if filename.startswith('_') or filename.startswith('.'):
            print(f"Skipping: {filename}")
            files_skipped += 1
            continue
        
        # Check if file has path separators encoded
        if '__' in filename:
            # Convert '__' back to path separators
            relative_path = filename.replace('__', os.sep)
            target_path = output_path / relative_path
            
            # Create parent directories
            target_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy the file
            shutil.copy2(file, target_path)
            print(f"✅ {filename}")
            print(f"   → {relative_path}")
            files_processed += 1
        else:
            # File without path encoding - copy to root of output
            target_path = output_path / filename
            shutil.copy2(file, target_path)
            print(f"📄 {filename} (no path structure)")
            files_processed += 1
    
    print("-" * 50)
    print(f"Done! Processed {files_processed} files, skipped {files_skipped} files.")
    print(f"Organized files are in: {output_path}")


def main():
    # Parse command line arguments
    source_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "organized"
    
    print("=" * 50)
    print("mObywatel Source Code Organizer")
    print("=" * 50)
    
    organize_files(source_dir, output_dir)


if __name__ == "__main__":
    main()
