"""
GraphQL Schema — READ-ONLY (Query only, no Mutation, no Subscription).
"""

import strawberry
from src.graphql.queries import Query

schema = strawberry.Schema(query=Query)
