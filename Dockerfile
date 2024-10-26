# Use a Python base image
FROM python:3.8-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy the requirements file
COPY requirements.txt .

# Install the required packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Ensure the script has executable permissions
RUN chmod +x /usr/src/app/start_servers.sh

# Expose the port (adjust if needed)
EXPOSE 8081

# Run the application
CMD ["sh", "/usr/src/app/start_servers.sh"]
