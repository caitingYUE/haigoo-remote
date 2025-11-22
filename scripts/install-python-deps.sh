#!/bin/bash
# 预发环境 Python 依赖安装脚本

echo "Installing Python dependencies for resume parsing..."

# 安装 pyresparser
pip3 install pyresparser

# 安装 spacy 和下载语言模型
pip3 install spacy
python3 -m spacy download en_core_web_sm

# 安装 nltk 和下载数据
pip3 install nltk
python3 -c "import nltk; nltk.download('stopwords'); nltk.download('punkt'); nltk.download('averaged_perceptron_tagger'); nltk.download('maxent_ne_chunker'); nltk.download('words')"

echo "Python dependencies installed successfully!"
