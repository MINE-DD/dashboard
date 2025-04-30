from api.index import app

# This is the recommended entry point for Vercel Python functions
def handler(request, context):
    """
    Vercel serverless function handler following the recommended pattern.
    https://vercel.com/docs/functions/runtimes/python
    """
    return app