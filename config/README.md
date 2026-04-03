# Configuration

This directory contains environment-specific configuration for your R&D project.

## Files

- `app.yaml` - Main configuration file with environment-specific settings

## Usage

The configuration system uses Pydantic for type-safe validation:

```python
import os
from apps.shared_py.config import get_config

# Set environment (defaults to 'development')
os.environ["APP_ENV"] = "development"

# Load configuration
config = get_config()

# Access values
print(config.app.name)
print(config.app.debug)
print(config.logging.level)
```

## Configuration Structure

```yaml
defaults:
  # Reusable configuration blocks using YAML anchors
  
environments:
  development:
    # Development environment settings
    
  test:
    # Test environment settings
    
  production:
    # Production environment settings
```

## Adding New Configuration

1. **Update `app.yaml`** with new settings:

```yaml
environments:
  development:
    my_feature:
      enabled: true
      threshold: 0.85
```

1. **Update `apps/shared_py/config/manager.py`** with Pydantic models:

```python
class MyFeatureConfig(BaseModel):
    """My feature configuration."""
    enabled: bool = False
    threshold: float = 0.5

class EnvironmentConfig(BaseModel):
    """Environment-specific configuration."""
    app: AppConfig
    logging: LoggingConfig
    feature_flags: FeatureFlagsConfig
    my_feature: MyFeatureConfig  # Add your config here
```

1. **Use in your code**:

```python
config = get_config()
if config.my_feature.enabled:
    # Use feature
    pass
```

## Pattern

This configuration pattern is taken from the main OBENA monorepo and provides:

- **Single source of truth**: All config in one YAML file
- **Environment-specific**: Different settings per environment
- **Type-safe**: Pydantic validation catches errors early
- **Easy migration**: Compatible with main repo structure
