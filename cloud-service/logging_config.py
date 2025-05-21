import logging
import os
from logging.handlers import RotatingFileHandler

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Logging settings
MAX_BODY_SIZE = 5000  # Maximum size of response body to log (in characters)
MAX_LIST_ITEMS = 5    # Maximum number of items from a list to include in logs
LOG_LEVEL = logging.INFO

def setup_logging():
    """Configure logging for the application"""
    
    # Create formatters
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create handlers
    console_handler = logging.StreamHandler()
    console_handler.setLevel(LOG_LEVEL)
    console_handler.setFormatter(console_formatter)
    
    # File handler with rotation
    api_file_handler = RotatingFileHandler(
        "logs/api.log", 
        maxBytes=10485760,  # 10MB
        backupCount=5
    )
    api_file_handler.setLevel(LOG_LEVEL)
    api_file_handler.setFormatter(file_formatter)
    
    # Error log with rotation
    error_file_handler = RotatingFileHandler(
        "logs/error.log", 
        maxBytes=10485760,  # 10MB
        backupCount=5
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(file_formatter)
    
    # Response body log with rotation (separate file for easier analysis)
    response_file_handler = RotatingFileHandler(
        "logs/responses.log", 
        maxBytes=20971520,  # 20MB (larger for response bodies)
        backupCount=5
    )
    response_file_handler.setLevel(LOG_LEVEL)
    response_file_handler.setFormatter(file_formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(LOG_LEVEL)
    root_logger.addHandler(console_handler)
    
    # Configure API logger
    api_logger = logging.getLogger("api")
    api_logger.setLevel(LOG_LEVEL)
    api_logger.addHandler(api_file_handler)
    api_logger.addHandler(error_file_handler)
    api_logger.addHandler(response_file_handler)
    
    # Configure blockchain logger
    blockchain_logger = logging.getLogger("blockchain")
    blockchain_logger.setLevel(LOG_LEVEL)
    blockchain_logger.addHandler(api_file_handler)
    blockchain_logger.addHandler(error_file_handler)
    
    return api_logger 