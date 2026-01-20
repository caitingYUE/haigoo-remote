#!/bin/bash
# 预发环境 Python 依赖安装脚本

echo "Installing Python dependencies for resume parsing..."

# 安装 Python 依赖
pip3 install -r server-utils/requirements.txt --break-system-packages

# 下载 spacy 语言模型
python3 -m spacy download en_core_web_sm

# 下载 nltk 数据
python3 -c "import nltk; nltk.download('stopwords'); nltk.download('punkt'); nltk.download('averaged_perceptron_tagger'); nltk.download('maxent_ne_chunker'); nltk.download('words')"

echo "Python dependencies installed successfully!"
